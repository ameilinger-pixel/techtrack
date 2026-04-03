import * as React from "react"

import { cn } from "@/lib/utils"

const Card = /** @type {any} */ (React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
    {...props}
  >
    {children}
  </div>
)))
Card.displayName = "Card"

const CardHeader = /** @type {any} */ (React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  >
    {children}
  </div>
)))
CardHeader.displayName = "CardHeader"

const CardTitle = /** @type {any} */ (React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  >
    {children}
  </div>
)))
CardTitle.displayName = "CardTitle"

const CardDescription = /** @type {any} */ (React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  >
    {children}
  </div>
)))
CardDescription.displayName = "CardDescription"

const CardContent = /** @type {any} */ (React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props}>
    {children}
  </div>
)))
CardContent.displayName = "CardContent"

const CardFooter = /** @type {any} */ (React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  >
    {children}
  </div>
)))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
