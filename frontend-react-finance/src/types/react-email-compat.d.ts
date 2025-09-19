// types/react-email-compat.d.ts
declare module "@react-email/components" {
  import * as React from "react";

  type FC<P = unknown> = React.FC<P>;

  export const Html: FC;
  export const Head: FC;
  export const Preview: FC;           // ✅ add Preview
  export const Body: FC<React.HTMLAttributes<HTMLBodyElement>>;
  export const Container: FC<React.HTMLAttributes<HTMLDivElement>>;
  export const Section: FC<React.HTMLAttributes<HTMLDivElement>>;
  export const Text: FC<React.HTMLAttributes<HTMLParagraphElement>>;
  export const Img: FC<React.ImgHTMLAttributes<HTMLImageElement>>;
  export const Hr: FC<React.HTMLAttributes<HTMLHRElement>>;
  export const Link: FC<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
}
