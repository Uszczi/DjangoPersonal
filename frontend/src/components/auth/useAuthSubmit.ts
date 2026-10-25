import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { apiErrorMessage } from "@personal/shared/apiErrorMessage";

/** Submits an account form: runs `action`, goes home on success, shows the API error otherwise. */
export function useAuthSubmit(action: () => Promise<unknown>) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await action();
      navigate({ to: "/" });
    } catch (err) {
      setError(await apiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, onSubmit };
}
