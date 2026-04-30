import { ChefHat } from "lucide-react";
import type { OrderStatus } from "@/types";

interface AnimatedStatusIconProps {
  status: OrderStatus;
}

export function AnimatedStatusIcon({ status }: AnimatedStatusIconProps) {
  if (status === "pending") return <PendingClock />;
  if (status === "preparing") return <PreparingChefHat />;
  return <ReadyCheck />;
}

function PendingClock() {
  return (
    <svg
      viewBox="0 0 40 40"
      className="h-10 w-10"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="2" />
      <line
        x1="20"
        y1="20"
        x2="20"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="animate-clock-hour"
        style={{ transformBox: "view-box", transformOrigin: "20px 20px" }}
      />
      <line
        x1="20"
        y1="20"
        x2="20"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="animate-clock-minute"
        style={{ transformBox: "view-box", transformOrigin: "20px 20px" }}
      />
      <circle cx="20" cy="20" r="1.6" fill="currentColor" />
    </svg>
  );
}

function PreparingChefHat() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -top-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        <span className="block h-2 w-[2px] rounded-full bg-current animate-steam-1" />
        <span className="block h-2 w-[2px] rounded-full bg-current animate-steam-2" />
        <span className="block h-2 w-[2px] rounded-full bg-current animate-steam-3" />
      </div>
      <ChefHat className="h-10 w-10" strokeWidth={2.2} aria-hidden="true" />
    </div>
  );
}

function ReadyCheck() {
  return (
    <div className="animate-ready-glow">
      <svg
        viewBox="0 0 52 52"
        className="h-10 w-10"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="26"
          cy="26"
          r="24"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-check-circle"
        />
        <path
          d="M14 27 L22 35 L38 19"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-check-mark"
        />
      </svg>
    </div>
  );
}
