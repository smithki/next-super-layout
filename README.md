# 🗺 `next-layout`

Next.js conveninently solves many of the headaches involved in modern React development. However, one of the fundamental pieces missing from Next.js is the ability to create clean, composable, and shareable layout abstractions. [There is some advice to be found in Next.js docs](https://nextjs.org/docs/basic-features/layouts), but no sufficient out-of-the-box abstraction. This problem only worsens when component-level data becomes necessary anywhere in your application; at which point your best bet is to "drill props" and deal with an unamanageable amount of `/pages` boilerplate. This project tries to solve the layouts problem with a simple, opinionated abstraction that plays nicely with existing Next.js conventions.

## Installation

Using NPM:

```zsh
npm install next-layout
```

Using Yarn:

```zsh
yarn add next-layout
```

## Usage

Bootstrapping new layout objects is a cinch with the `createLayout` function. Simply give your layout a `name`, describe some UI with `getLayout`, and fetch some initial props data using `getData`. Here's an MVP example:

```tsx
// layouts/my-layout.tsx
import { createLayout } from 'next-layout';

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

Once you've created a layout object, we'll connect it to our Next.js page:

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

If you need to fetch additional data for your page, you can define a custom `getStaticProps` or `getServerSideProps` function, then pass it as an argument to `myLayout.wrapGetStaticProps` or `myLayout.wrapGetServerSideProps`, respectively.

### Connecting `next-layout` to your Next.js application

To make use of our layout-wrapped pages, we'll need to define a custom Next.js `_app`. Check this out:

```tsx
// pages/_app
import { LayoutProvider } from 'next-layout';

export default function App(props) {
  return <LayoutProvider {...props} />;
}
```

_Voila!_

### Composing layouts

With `next-layout` it's easy to compose multiple layouts together using the `composeLayouts` function:

```tsx
// pages/some/path.tsx
import { combineLayouts } from 'next-layout';
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

## License

[MIT](./LICENSE)
