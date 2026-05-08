import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function PcAuthCard({ title, subtitle, children }: Props) {
  return (
    <div className="pc-auth-root">
      <div className="pc-auth-card">
        <p className="pc-auth-kicker">Pinta · Plan Comercial</p>
        <h1 className="pc-auth-title">{title}</h1>
        {subtitle ? <p className="pc-auth-subtitle">{subtitle}</p> : null}
        <div className="pc-auth-actions">{children}</div>
      </div>
    </div>
  );
}
