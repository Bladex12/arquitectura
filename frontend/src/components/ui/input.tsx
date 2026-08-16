import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, id, ...props }, ref) => {
    const input = (
      <input
        id={id}
        type={type}
        className={cn(
          "flex h-12 w-full rounded-lg border-2 border-input bg-background px-3 py-2 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (!label) return input;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        {input}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };



