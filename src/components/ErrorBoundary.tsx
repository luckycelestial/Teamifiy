"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { reportClientError } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportClientError("ErrorBoundary", error, {
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-card p-6 text-center shadow-card-soft space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-1">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An unexpected interface error occurred. The incident has been automatically reported to our telemetry diagnostics.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="rounded-lg bg-muted/40 p-3 text-left border border-border">
                <p className="font-mono text-[11px] text-destructive/90 break-words line-clamp-3">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-1.5 text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reload Portal
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-navy hover:bg-navy/90 text-white gap-1.5 text-xs font-semibold"
              >
                <Link href="/">
                  <Home className="h-3.5 w-3.5" /> Return Home
                </Link>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
