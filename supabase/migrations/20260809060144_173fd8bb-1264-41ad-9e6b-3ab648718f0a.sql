-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','student');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  roll_no text,
  department text,
  year int,
  gender text,
  phone text,
  skills text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TEAMS
CREATE TYPE public.team_status AS ENUM ('forming','submitted','approved','rejected','locked');

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  problem_statement text,
  category text,
  leader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.team_status NOT NULL DEFAULT 'forming',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_leader boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_leader(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND leader_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.team_is_open(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND status IN ('forming','rejected'))
$$;

CREATE OR REPLACE FUNCTION public.my_team_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.team_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE POLICY "Authenticated can view teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leader creates team" ON public.teams FOR INSERT TO authenticated WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leader updates own open team" ON public.teams FOR UPDATE TO authenticated
  USING (leader_id = auth.uid() AND status IN ('forming','rejected')) WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leader deletes own open team" ON public.teams FOR DELETE TO authenticated
  USING (leader_id = auth.uid() AND status IN ('forming','rejected'));
CREATE POLICY "Admins manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated can view members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Join own membership" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.team_is_open(team_id));
CREATE POLICY "Leave or leader removes" ON public.team_members FOR DELETE TO authenticated
  USING (public.team_is_open(team_id) AND (user_id = auth.uid() OR public.is_team_leader(team_id, auth.uid())));
CREATE POLICY "Admins manage members" ON public.team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- membership guards
CREATE OR REPLACE FUNCTION public.guard_team_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int; st public.team_status;
BEGIN
  SELECT status INTO st FROM public.teams WHERE id = NEW.team_id;
  IF st NOT IN ('forming','rejected') THEN
    RAISE EXCEPTION 'This team is locked and cannot be changed.';
  END IF;
  SELECT count(*) INTO cnt FROM public.team_members WHERE team_id = NEW.team_id;
  IF cnt >= 6 THEN
    RAISE EXCEPTION 'A team can have at most 6 members.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_guard_team_member BEFORE INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.guard_team_member();

-- INVITATIONS
CREATE TYPE public.invite_status AS ENUM ('pending','accepted','declined','cancelled');

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.invite_status NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (team_id, invitee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "See own invites" ON public.invitations FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid() OR team_id = public.my_team_id() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Leader sends invite" ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND public.is_team_leader(team_id, auth.uid()) AND public.team_is_open(team_id));
CREATE POLICY "Respond to invite" ON public.invitations FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid()) WITH CHECK (invitee_id = auth.uid() OR inviter_id = auth.uid());
CREATE POLICY "Leader cancels invite" ON public.invitations FOR DELETE TO authenticated
  USING (inviter_id = auth.uid());
CREATE POLICY "Admins manage invites" ON public.invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- can't invite someone already in a team, or when team is full
CREATE OR REPLACE FUNCTION public.guard_invitation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cnt int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = NEW.invitee_id) THEN
    RAISE EXCEPTION 'That student is already in a team.';
  END IF;
  SELECT count(*) INTO cnt FROM public.team_members WHERE team_id = NEW.team_id;
  IF cnt >= 6 THEN
    RAISE EXCEPTION 'Your team is already full.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_guard_invitation BEFORE INSERT ON public.invitations
FOR EACH ROW EXECUTE FUNCTION public.guard_invitation();

-- when a student joins a team, cancel all their other pending invites
CREATE OR REPLACE FUNCTION public.cleanup_after_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.invitations
     SET status = 'cancelled', responded_at = now()
   WHERE invitee_id = NEW.user_id AND status = 'pending' AND team_id <> NEW.team_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cleanup_after_join AFTER INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.cleanup_after_join();

-- accepting an invite: atomic, handles all edge cases
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.invitations%ROWTYPE; cnt int; st public.team_status;
BEGIN
  SELECT * INTO inv FROM public.invitations WHERE id = _invitation_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found.'; END IF;
  IF inv.invitee_id <> auth.uid() THEN RAISE EXCEPTION 'This invitation is not for you.'; END IF;
  IF inv.status <> 'pending' THEN RAISE EXCEPTION 'This invitation is no longer pending.'; END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a team. Leave or disband your current team first.';
  END IF;
  SELECT status INTO st FROM public.teams WHERE id = inv.team_id;
  IF st NOT IN ('forming','rejected') THEN RAISE EXCEPTION 'That team is locked.'; END IF;
  SELECT count(*) INTO cnt FROM public.team_members WHERE team_id = inv.team_id;
  IF cnt >= 6 THEN RAISE EXCEPTION 'That team is already full.'; END IF;

  INSERT INTO public.team_members (team_id, user_id, is_leader) VALUES (inv.team_id, auth.uid(), false);
  UPDATE public.invitations SET status = 'accepted', responded_at = now() WHERE id = inv.id;
  RETURN inv.team_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- creating a team: atomic, blocks users who already belong to a team
CREATE OR REPLACE FUNCTION public.create_team(_name text, _problem_statement text, _category text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in.'; END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already in a team.';
  END IF;
  INSERT INTO public.teams (name, problem_statement, category, leader_id)
  VALUES (_name, _problem_statement, _category, auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.team_members (team_id, user_id, is_leader) VALUES (new_id, auth.uid(), true);
  RETURN new_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_team(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();