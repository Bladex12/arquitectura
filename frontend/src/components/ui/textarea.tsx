import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, id, ...props }, ref) => {
    const textarea = (
      <textarea
        id={id}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )

    if (!label) return textarea;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        {textarea}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

