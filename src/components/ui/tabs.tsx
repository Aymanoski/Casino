'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex w-full max-w-full items-center justify-start gap-1.5 overflow-x-auto no-scrollbar rounded-button border-2 border-outline bg-paper-2 p-1.5 text-ink-muted shadow-sticker-sm sm:inline-flex sm:w-auto sm:flex-wrap',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-ribbon border-2 border-transparent px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 hover:text-red-900 data-[state=active]:border-outline data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sticker-sm',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-blue-500 rounded-card',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
