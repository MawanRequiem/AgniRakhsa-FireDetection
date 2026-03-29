import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// 1. Tambahkan kata 'export' langsung di depan const
export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30",
        ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-2.5",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem]",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export const Button = React.forwardRef(({ 
  className, 
  variant, 
  size, 
  asChild = false, // 1. TANGKAP asChild di sini
  ...props         // 2. Sekarang props ini BERSIH, tidak ada asChild di dalamnya
}, ref) => {
  return (
    <ButtonPrimitive
      ref={ref}
      asChild={asChild} // 3. Berikan asChild hanya ke Primitive Base UI
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}        // 4. Aman! Browser tidak akan melihat asChild lagi
    />
  );
});

Button.displayName = "Button";