# 🗺 `next-super-layout`

Next.js conveniently solves many of the headaches involved with modern React development. However, one of the fundamental pieces still _missing_ from Next.js is the ability to create clean, composable, data-infused layouts. [There is some advice to be found in Next.js docs](https://nextjs.org/docs/basic-features/layouts), but no sufficient out-of-the-box abstraction. This problem only worsens when component-level data becomes necessary anywhere in your application; at which point your only option is to "drill props" and deal with increasing amounts of `/pages` boilerplate. This project tries to solve the layouts problem with a simple, opinionated abstraction that plays nicely with existing Next.js conventions.

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

> **Note**
> These instructions are written for `>=v3.x`. For V2 docs, [start here!](./V2-DOCS.md)

Bootstrapping new layouts is a cinch using the `createLayout` function. Simply give your layout a `name` and describe some UI with `getLayout`:

```tsx
// layouts/my-layout.tsx
import { createLayout } from 'next-super-layout';

export const myLayout = createLayout({
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
});
```

> **Note**
> If you encounter messages from ESLint about "rules of hooks" violations because `"React component names must start with an uppercase letter"`, you can resolve this by changing `getLayout` to `GetLayout` (note the capitalization).

Once we've created our layout, we'll connect it to a Next.js page using `createPageWrapper`:

```tsx
// pages/some/path.tsx
import { createPageWrapper } from 'next-super-layout';
import { myLayout } from './layouts/my-layout';

const wrapPage = createPageWrapper(myLayout);

export default wrapPage((props) => {
  return <>{...}</>;
});
```

### Fetching layout data

We can also connect our layout to a static data source wrapping [`getStaticProps`](https://nextjs.org/docs/basic-features/data-fetching/get-static-props) or [`getServerSideProps`](https://nextjs.org/docs/basic-features/data-fetching/get-server-side-props). First, we'll create a data fetcher using `Layout.createDataFetcher`:

```tsx
// layouts/my-layout.data.tsx
import { myLayout } from './my-layout';

export const myLayoutData = myLayout.createDataFetcher(async (ctx) => {
  // `ctx` is the `GetStaticPropsContext` object passed to `getStaticProps`.
  return { ... };
});
```

Then, we'll revist our Next.js page to inject our data with `createDataWrapper`:

```diff
  // pages/some/path.tsx
- import { createPageWrapper } from 'next-super-layout';
+ import { createPageWrapper, createDataWrapper } from 'next-super-layout';
  import { myLayout } from './layouts/my-layout';
+ import { myLayoutData} from './layouts/my-layout.data';

  const wrapPage = createPageWrapper(myLayout);
+ const dataWrapper = createDataWrapper(myLayoutData);

  export default wrapPage((props) => {
    return <>{...}</>;
  });

+ export const getStaticProps = dataWrapper.wrapGetStaticProps(...);
  // or...
+ export const getServerSideProps = dataWrapper.wrapGetServerSideProps(...);
```

Should you need to fetch additional data for your page, you can define a page-specific `getStaticProps` or `getServerSideProps` function, then pass it to `wrapGetStaticProps` or `wrapGetServerSideProps`, respectively.

> **Note**
> Shorthands for `wrapGetStaticProps` and `wrapGetServerSideProps` are also available: `gSP` and `gSSP`, respectively.

### (Optional) Connecting `next-super-layout` to your Next.js `_app`

To ensure that layout-specific state is persisted between route changes, we can choose to define a custom Next.js `_app` component onto which we'll connect our layout-wrapped pages. Take a look:

```tsx
// pages/_app
import { LayoutProvider } from 'next-super-layout';

export default function App(props) {
  return <LayoutProvider {...props} />;
}
```

_Voila!_

### Composing layouts

With `next-super-layout`, it's effortless to compose multiple layouts together using variadic parameters given to the`createPageWrapper` and `createDataWapper` functions:

```diff
  // pages/some/path.tsx
  import { createPageWrapper, createDataWrapper } from 'next-super-layout';
  import { myLayout } from './layouts/my-layout';
  import { myLayoutData} from './layouts/my-layout.data';

+ import { myOtherLayout } from './layouts/my-other-layout';
+ import { myOtherLayoutData} from './layouts/my-other-layout.data';

- const wrapPage = createPageWrapper(myLayout);
+ const wrapPage = createPageWrapper(myLayout, myOtherLayout);
- const dataWrapper = createDataWrapper(myLayoutData);
+ const dataWrapper = createDataWrapper(myLayoutData, myOtherLayoutData);

  export default wrapPage((props) => {
    return <>{...}</>;
  });

  export const getStaticProps = dataWrapper.wrapGetStaticProps(...);
  // or...
  export const getServerSideProps = dataWrapper.wrapGetServerSideProps(...);
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

## ⚖️ License

[MIT](./LICENSE)
