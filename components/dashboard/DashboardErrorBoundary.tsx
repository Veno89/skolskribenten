"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardErrorState } from "@/components/dashboard/DashboardErrorState";

interface BoundaryProps {
  children: ReactNode;
  resetKey: string;
}

interface BoundaryState {
  error: Error | null;
  resetKey: string;
}

class DashboardErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {
    error: null,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return {
        error: null,
        resetKey: props.resetKey,
      };
    }

    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Dashboard client error", { error, errorInfo });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <DashboardErrorState
          actionLabel="Försök igen"
          eyebrow="Något gick fel"
          message="En del av dashboarden slutade svara. Försök igen utan att lämna sidan."
          onAction={this.reset}
          title="Vi kunde inte visa den här vyn"
        />
      );
    }

    return this.props.children;
  }
}

export function DashboardErrorBoundary({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();

  return (
    <DashboardErrorBoundaryInner resetKey={pathname}>
      {children}
    </DashboardErrorBoundaryInner>
  );
}
