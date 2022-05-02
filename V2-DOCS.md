# 🗺 `next-super-layout@2.x`

## 📦 Installation

Using NPM:

```zsh
npm install next-super-layout
```

Using Yarn:

```zsh
yarn add next-super-layout
```

## 🛠 Usage

Bootstrapping new layouts is a cinch using the `createLayout` function. Simply give your layout a `name`, describe some UI with `getLayout`, and fetch some initial props data using `getData`. Take a look:

```tsx
// layouts/my-layout.tsx
import { createLayout } from 'next-super-layout';

const myLayout = createLayout({
  name: 'myLayout', // choose something unique from amongst all your layouts

  getLayout: (page, data) => {
    // `page` is the React element being wrapped.
    // `data` is the data returned from the `getData` function.
    return (<>
      <MyHeader />
      {page}
      <MyFooter />
    </>);
  },

  getData: async (ctx) => {
    // `ctx` is the `GetStaticPropsContext` object passed to `getStaticProps`.
    return { ... };
  },
});
```

Once we've created a layout, we'll connect it to a Next.js page:

```tsx
// pages/some/path.tsx
import { myLayout } from './layouts/my-layout';

export default myLayout.wrapPage((props) => {
  return <>{...}</>;
});

export const getStaticProps = myLayout.wrapGetStaticProps(...);
// or...
export const getServerSideProps = myLayout.wrapGetServerSideProps(...);
```

Should you need to fetch additional data for your page, you can define a custom [`getStaticProps`](https://nextjs.org/docs/basic-features/data-fetching/get-static-props) or [`getServerSideProps`](https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props) function, then pass it to `Layout.wrapGetStaticProps` or `Layout.wrapGetServerSideProps`, respectively.

### Connecting `next-super-layout` to your Next.js application

To make use of our layout-wrapped pages, we'll need to define a custom Next.js `_app`. Don't worry, it's pretty easy:

```tsx
// pages/_app
import { LayoutProvider } from 'next-super-layout';

export default function App(props) {
  return <LayoutProvider {...props} />;
}
```

_Voila!_

### Composing layouts

With `next-super-layout`, it's effortless to compose multiple layouts together using the `combineLayouts` function:

```tsx
// pages/some/path.tsx
import { combineLayouts } from 'next-super-layout';
import { myLayout } from './layouts/my-layout';
import { myOtherLayout } from './layouts/my-other-layout';

const combinedLayout = combineLayouts(myLayout, myOtherLayout);

export default combinedLayout.wrapPage((props) => {
  return <>{...}</>;
});

export const getStaticProps = combinedLayout.wrapGetStaticProps(...);
// or...
export const getServerSideProps = combinedLayout.wrapGetServerSideProps(...);
```

### Using layout data

Layouts contain a `useData` hook that easily connects any component within the React tree of a page to the data retrieved by that page's `getData` fetcher.

```tsx
// components/my-component.tsx
import { myLayout } from './layouts/my-layout';

function MyComponent() {
  const myLayoutData = myLayout.useData();

  // ...

  return <>{...}</>
}
```

## Limitations

> `>=v3.x` largely solves these limitations at the cost of a few breaking API changes. You are highly encouraged to [upgrade to `>=v3.x` instead!](./README.md)

The nature of Next.js as a universal JavaScript framework means that some trade-offs have to be made for `next-super-layout` in the spirit of simplicity. Most notably, `getData` functions defined in your templates are inevitably bundled into client-side code. This has two undesirable side-effects:

1. Some unnecessary weight is added to your client-side bundle.
2. `getData` can't invoke server-only Node APIs like [`fs`](https://nodejs.org/api/fs.html) due to [Edge-runtime](https://nextjs.org/docs/api-reference/edge-runtime) constraints.

Because `getData` runs only on the server-side, the effects of #1 can be offset through [dead code elimination](https://en.wikipedia.org/wiki/Dead_code_elimination) by checking for `typeof window === 'undefined'`, like so:

```tsx
const myLayout = createLayout({
  getData: async (ctx) => {
    // At production build-time, this statement
    // will be removed by the Next.js minifier.
    if (typeof window === 'undefined') {
      return { ... };
    }
  },
});
```

#2 is a tougher nut to crack that may require some truly complex, under-the-hood tinkering in Next.js itself. Perhaps there's hope for a [custom SWC plugin](https://swc.rs/docs/usage/plugins) to modify `getData` definitions at build-time. For now, Next.js lacks support for configuring arbitrary SWC plugins — most likely for performance and/or stability reasons.
