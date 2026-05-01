import { useEffect, useState } from "react";
import { getLastCustomerName } from "@/lib/orderHistory";

/**
 * Time-of-day window. Late-night falls back to a neutral "Hi" so we
 * don't tell someone "Good evening" at 2am.
 */
function timeOfDayGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Hi";
}

/**
 * Pick a subtitle that varies a touch based on whether the customer
 * has ordered here before. Returning diners get a warmer line that
 * doesn't sound like a generic prompt; first-timers get a simple
 * invitation. Both are kept short — the carousel sits right below
 * and shouldn't have to compete with chatty copy.
 */
function subtitleFor(isReturning: boolean): string {
  return isReturning ? "What are you craving today?" : "Browse the menu and tap to add.";
}

export function Greeting() {
  // Compute on mount: the hour shouldn't shift mid-session and we
  // want the greeting stable while the customer is browsing.
  const [greeting, setGreeting] = useState(() =>
    timeOfDayGreeting(new Date().getHours())
  );
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(timeOfDayGreeting(new Date().getHours()));
    setName(getLastCustomerName());
  }, []);

  const isReturning = name !== null;
  const headline = isReturning ? `${greeting}, ${name}` : greeting;

  return (
    <section className="animate-fade-up">
      <h1 className="text-2xl font-extrabold leading-none tracking-tight">
        {headline}
      </h1>
      <p className="mt-1 text-sm leading-snug text-muted-foreground">
        {subtitleFor(isReturning)}
      </p>
    </section>
  );
}
