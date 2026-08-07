import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface DrawerProps {
  children: ReactNode;
  description: string;
  open: boolean;
  on_open_change: (open: boolean) => void;
  title: string;
}

export function Drawer({
  children,
  description,
  on_open_change,
  open,
  title
}: DrawerProps) {
  return (
    <Dialog.Root onOpenChange={on_open_change} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
