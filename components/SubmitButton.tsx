"use client";
import { useFormStatus } from "react-dom";

export default function SubmitButton({ label, pending }: { label: string; pending: string }) {
  const { pending: p } = useFormStatus();
  return <button type="submit" className="btn primary wide" disabled={p}>{p ? pending : label}</button>;
}
