// types/react-email-compat.d.ts
declare module "@react-email/components" {
  import * as React from "react";
  type C = React.ComponentType<unknown>;

  export const Html: C;
  export const Head: C;
  export const Preview: C;
  export const Body: C;
  export const Container: C;
  export const Section: C;
  export const Text: C;
  export const Img: C;
  export const Hr: C;
  export const Link: C;
}
