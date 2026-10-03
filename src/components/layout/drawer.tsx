import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../actions/button";
import styles from "./drawer.module.css";

interface DrawerProps {
  children: ReactNode;
  description: string;
  open: boolean;
  on_open_change: (open: boolean) => void;
  on_close_auto_focus?: (event: Event) => void;
  title: string;
}

export function Drawer({
  children,
  description,
  on_open_change,
  on_close_auto_focus,
  open,
  title
}: DrawerProps) {
  return (
    <Dialog.Root onOpenChange={on_open_change} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          onCloseAutoFocus={on_close_auto_focus}
        >
          <div className={styles.heading}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button
                aria-label="Close navigation"
                className={styles.close}
                tone="secondary"
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className={styles.description}>
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
