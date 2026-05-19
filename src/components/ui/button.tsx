import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.7rem] border-[2px] text-[1.05rem] font-black leading-none ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffe08a] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0.5",
  {
    variants: {
      variant: {
        default:
          "border-[#8b4a18] bg-[linear-gradient(180deg,#ffe68a_0%,#ffc43d_52%,#e7821f_100%)] text-[#3c1d07] shadow-[0_5px_0_#7c3812,0_12px_20px_rgba(0,0,0,0.34),inset_0_2px_0_rgba(255,255,255,0.58)] hover:brightness-110 active:shadow-[0_2px_0_#7c3812,0_7px_12px_rgba(0,0,0,0.3),inset_0_2px_0_rgba(255,255,255,0.45)]",
        destructive:
          "border-[#6f1d15] bg-[linear-gradient(180deg,#ff9b86_0%,#ef4a33_55%,#a9271b_100%)] text-white shadow-[0_5px_0_#64170f,0_12px_20px_rgba(0,0,0,0.34),inset_0_2px_0_rgba(255,255,255,0.36)] hover:brightness-110",
        outline:
          "border-[#d8ad68] bg-[linear-gradient(180deg,rgba(65,38,19,0.96),rgba(22,13,7,0.98))] text-[#ffe2a5] shadow-[0_4px_0_#5e3518,0_10px_18px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-[#3d2512] hover:text-white",
        secondary:
          "border-[#c28a50] bg-[linear-gradient(180deg,#5b3418_0%,#2b190c_58%,#160c06_100%)] text-[#ffe0aa] shadow-[0_4px_0_#4a2710,0_10px_16px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-115 hover:text-white",
        ghost:
          "border-[#d8ad68]/70 bg-[linear-gradient(180deg,rgba(50,29,14,0.9),rgba(16,10,6,0.94))] text-[#ffe5b2] shadow-[0_4px_0_rgba(78,39,14,0.9),0_9px_16px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.14)] hover:brightness-115 hover:text-white",
        link: "border-transparent bg-transparent text-[#ffe08a] shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-2",
        sm: "h-11 rounded-[0.65rem] px-4",
        lg: "h-14 rounded-[0.8rem] px-9 text-[1.18rem]",
        icon: "h-10 w-10 rounded-[0.65rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
