import type { GetServerSideProps, GetStaticProps, GetStaticPropsContext, NextPage } from 'next';
import type { AppProps } from 'next/app';
import type { ParsedUrlQuery } from 'querystring';
import React, { createContext, ReactElement, ReactNode, useContext, useMemo } from 'react';

type UnwrapArray<T> = T extends (infer U)[] ? U : T;

export type GetLayoutFn<Data> = (page: ReactElement, data: Data) => ReactNode;

type NextPageWithLayout = NextPage & {
  getLayout?: (Component: AppProps['Component'], pageProps: any) => ReactNode;
};

export type Layout<Data = any> = {
  wrapPage: <Page extends NextPage<any, any>>(page: Page) => Page & { getLayout: GetLayoutFn<Data> };

  wrapGetStaticProps: <
    P extends { [key: string]: any } = { [key: string]: any },
    Q extends ParsedUrlQuery = ParsedUrlQuery,
  >(
    wrappedGetStaticProps?: GetStaticProps<P, Q>,
  ) => GetStaticProps<P, Q>;

  wrapGetServerSideProps: <
    P extends { [key: string]: any } = { [key: string]: any },
    Q extends ParsedUrlQuery = ParsedUrlQuery,
  >(
    wrappedGetServerSideProps?: GetServerSideProps<P, Q>,
  ) => GetServerSideProps<P, Q>;

  useData: () => Data;
};

type LayoutData<T extends Layout<any>> = T extends Layout<infer R> ? R : never;

export interface CreateLayoutOptions<Data> {
  name: string;
  getLayout?: GetLayoutFn<Data>;
  getData?: (ctx: GetStaticPropsContext) => Promise<Data>;
}

const LayoutContext = /* @__PURE__ */ createContext<any>({});

/**
 * Creates a generic view for a layout, complete with layout-specific props,
 * fetched at build and/or request time.
 *
 * @example
 * ```tsx
 * // layouts/my-layout.tsx
 * import { createLayout } from 'layouts/base';
 *
 * const myLayout = createLayout({
 *   name: 'myLayout', // something unique amongst all layouts
 *
 *   getLayout: (page, data) => {
 *     // `page` is the React element being wrapped.
 *     // `data` is the data returned by the `getData` function.
 *
 *     return (<>
 *       <MyHeader />
 *       {page}
 *       <MyFooter />
 *     </>);
 *   },
 *
 *   getData: async (ctx) => {
 *     // `ctx` is the `GetStaticPropsContext` object passed to `getStaticProps`.
 *     return { ... };
 *   },
 * });
 *
 * // pages/some/path.tsx
 * import { myLayout } from 'layouts/my-layout';
 *
 * export default myLayout.withLayout((props) => {
 *   return <>{...}</>;
 * });
 *
 * export const getStaticProps = myLayout.wrapGetStaticProps(...);
 * // or...
 * export const getServerSideProps = myLayout.wrapGetServerSideProps(...);
 * ```
 */
export function createLayout<Data = any>(options: CreateLayoutOptions<Data>): Layout<Data> {
  const layoutKey = `__layout:${options.name}`;

  return {
    // @ts-ignore - This is used internally; not exposed to public API.
    '__layoutOptions': options,

    wrapPage: (Page: any) => {
      Page.getLayout = ((Component, pageProps) => {
        const { [layoutKey]: layoutProps, ...rest } = pageProps;

        const isCombinedLayout = options.name.startsWith('__combined');
        const currCtx = useContext(LayoutContext);
        const ctx: any = useMemo(() => {
          return isCombinedLayout
            ? {
                ...currCtx,
                ...layoutProps,
              }
            : {
                ...currCtx,
                [layoutKey]: layoutProps,
              };
        }, [isCombinedLayout, currCtx, layoutProps]);

        return (
          <LayoutContext.Provider value={ctx}>
            {options.getLayout ? options.getLayout(<Component {...rest} />, layoutProps) : <Component {...rest} />}
          </LayoutContext.Provider>
        );
      }) as NextPageWithLayout['getLayout'];

      return Page;
    },

    wrapGetStaticProps: (wrappedGetStaticProps = defaultGetProps as any) => {
      return async (ctx) => {
        const staticProps: any = (await wrappedGetStaticProps(ctx)) ?? {};
        const layoutStaticProps: any = await options.getData?.(ctx);

        return {
          ...staticProps,
          props: {
            ...(staticProps.props ?? {}),
            [layoutKey]: layoutStaticProps?.[layoutKey] ?? layoutStaticProps,
          },
        };
      };
    },

    wrapGetServerSideProps: (wrappedGetServerSideProps = defaultGetProps as any) => {
      return async (ctx) => {
        const serverSideProps: any = (await wrappedGetServerSideProps(ctx)) ?? {};
        const layoutStaticProps: any = await options.getData?.(ctx);
        return {
          ...serverSideProps,
          props: {
            ...(serverSideProps.props ?? {}),
            [layoutKey]: layoutStaticProps?.[layoutKey] ?? layoutStaticProps,
          },
        };
      };
    },

    useData: () => {
      const ctx = useContext(LayoutContext);

      if (ctx[layoutKey] == null) {
        throw new Error(
          `[next-layout: useData -> "${options.name}"] You're seeing this error for one of three reasons:
  - You forgot to wrap \`getStaticProps\` or \`getServerSideProps\` with the wrapper function for this layout.
  - \`useData()\` was called from a React tree not wrapped with this layout at the NextJS page-level.
  - \`useData()\` was called within \`getLayout()\` in the definition for this layout.
    Use the second \`data\` parameter given to \`getLayout()\` instead.`,
        );
      }

      return ctx[layoutKey];
    },
  };
}

async function defaultGetProps() {
  return {
    props: {},
  };
}

const getOptionsFromLayout = (layout: Layout<any>): CreateLayoutOptions<any> => (layout as any)['__layoutOptions'];

/**
 * Combines layout objects (the result of `createLayout(...)`) into a singular layout.
 *
 * @example
 * ```tsx
 * // pages/some/path.tsx
 * import { combineLayouts } from 'layouts/base';
 * import { myLayout } from 'layouts/my-layout';
 * import { myOtherLayout } from 'layouts/my-other-layout';
 *
 * const combinedLayout = combineLayouts(myLayout, myOtherLayout);
 *
 * export default combinedLayout.wrapPage((props) => {
 *   return <>{...}</>;
 * });
 *
 * export const getStaticProps = combinedLayout.wrapGetStaticProps(...);
 * // or...
 * export const getServerSideProps = combinedLayout.wrapGetServerSideProps(...);
 * ```
 */
export function combineLayouts<T extends Array<Layout<any>>>(...layouts: T) {
  const result = createLayout<LayoutData<UnwrapArray<T>>>({
    name: `__combined(${layouts.map((l) => getOptionsFromLayout(l).name).join(';')})`,

    getLayout: (page, data) => {
      const pagesCombined = layouts.reduceRight((element, l) => {
        const layoutOptions = getOptionsFromLayout(l);
        const layoutKey = `__layout:${layoutOptions.name}`;
        return <>{layoutOptions.getLayout ? layoutOptions.getLayout(element, data[layoutKey]) : element}</>;
      }, <>{page}</>);

      return <>{pagesCombined}</>;
    },

    getData: async (ctx) => {
      const results = await Promise.all(
        layouts.map(async (l) => {
          const layoutOptions = getOptionsFromLayout(l);
          const layoutKey = `__layout:${layoutOptions.name}`;
          return { [layoutKey]: await layoutOptions.getData?.(ctx) };
        }),
      );

      return Object.assign({}, ...results.filter(Boolean));
    },
  });

  // @ts-ignore - We omit `useData` from the final result type.
  delete result.useData;

  return result as Omit<typeof result, 'useData'>;
}

/**
 * Renders a page with layout data. For use within a custom NextJS `_app` component.
 *
 * @example
 * ```ts
 * // pages/_app
 * export default function App(props) {
 *   return <LayoutProvider {...props} />;
 * }
 * ```
 */
export const LayoutProvider: React.FC<AppProps> = ({ Component, pageProps }) => {
  // Use the layout defined at the page level, if available...
  const getLayout = (Component as NextPageWithLayout).getLayout ?? ((C, P) => <C {...P} />);

  return <>{getLayout(Component, pageProps)}</>;
};
