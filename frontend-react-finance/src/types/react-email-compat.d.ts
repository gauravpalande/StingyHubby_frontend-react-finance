declare module "@react-email/components" {
  import * as React from "react";
  export const Html: React.FC<React.PropsWithChildren<unknown>>;
  export const Head: React.FC<React.PropsWithChildren<unknown>>;
  export const Body: React.FC<React.HTMLAttributes<HTMLBodyElement>>;
  export const Container: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const Section: React.FC<React.HTMLAttributes<HTMLDivElement>>;
  export const Text: React.FC<React.HTMLAttributes<HTMLParagraphElement>>;
  export const Img: React.FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  export const Hr: React.FC<React.HTMLAttributes<HTMLHRElement>>;
  export const Link: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
}
