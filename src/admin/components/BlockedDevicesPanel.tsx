import { useState } from "react";
import { Shield, ShieldOff } from "lucide-react";
import { formatRelative } from "@/utils";
import { useBlockedDevices } from "../useBlockedDevices";

/**
 * "Currently blocked" panel — surfaces the device_blocklist so staff
 * can review who's banned and undo a block. Renders nothing when the
 * list is empty so it doesn't take up real estate during normal ops.
 *
 * Lives at the top of the Activity page because that's where staff
 * already go to audit anti-abuse activity. No nav entry of its own.
 */
export function BlockedDevicesPanel() {
  const { devices, unblock } = useBlockedDevices();
  const [now] = useState(() => Date.now());

  if (devices.length === 0) return null;

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-destructive" strokeWidth={2.4} />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-destructive">
          {devices.length} device{devices.length === 1 ? "" : "s"} blocked
        </h2>
      </div>
      <ul className="mt-2 space-y-1.5">
        {devices.map((device) => (
          <li
            key={device.deviceId}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2 text-xs">
                <span className="font-mono font-semibold tabular-nums">
                  {device.deviceId.slice(0, 8)}…
                </span>
                {device.reason && (
                  <span className="truncate text-muted-foreground">
                    {device.reason}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                blocked {formatRelative(device.createdAt, now)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => unblock(device.deviceId)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              <ShieldOff className="h-3 w-3" strokeWidth={2.4} />
              Unblock
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
