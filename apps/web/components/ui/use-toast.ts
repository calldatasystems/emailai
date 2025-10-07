import { toast as sonnerToast } from "sonner";

interface ToastProps {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  return {
    toast: (props: ToastProps | string) => {
      if (typeof props === "string") {
        return sonnerToast(props);
      }

      const { title, description, variant } = props;
      const message = title && description ? `${title}: ${description}` : title || description || "";

      if (variant === "destructive") {
        return sonnerToast.error(message);
      }

      return sonnerToast.success(message);
    },
  };
}
