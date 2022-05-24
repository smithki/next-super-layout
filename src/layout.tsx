import type { AppProps } from 'next/app';
import { useRouter } from 'next/router.js';
import React, { createContext, PropsWithChildren, useContext } from 'react';
import { createError } from './exceptions';
import {
  CreateLayoutOptions,
  Layout,
  PageWithLayout,
  LayoutMeta,
  PageWrapperFn,
  GetStaticPropsWrapper,
  GetServerSidePropsWrapper,
  DataLayout,
} from './types';

const LayoutProviderContext = /* @__PURE__ */ createContext<boolean>(false);

/**
 * Creates a generic layout view.
 *
 * @example
 * ```tsx
 * // layouts/my-layout.tsx
 * import { createLayout } from 'next-super-layout';
 *
 * export const myLayout = createLayout({
 *   name: 'myLayout', // choose something unique from amongst all your layouts
 *
 *   getLayout: (page, data) => {
 *     // `page` is the React element being wrapped.
 *     // `data` is the data returned from the `getData` function.
 *
 *     return (<>
 *       <MyHeader />
 *       {page}
 *       <MyFooter />
 *     </>);
 *   },
 * });
 *
 * // layouts/my-layout.data.ts
 * import { myLayout } from './my-layout'
 *
 * export const myLayoutData = myLayout.createDataFetcher(async (ctx) => {
 *   // `ctx` is the `GetStaticPropsContext` object passed to `getStaticProps`.
 *   return { ... };
 * });
 *
 * // pages/some/path.tsx
 * import { createPageWrapper, createDataWrapper } from 'next-super-layout
 * import { myLayout } from 'layouts/my-layout';
 * import { myLayoutData } from 'layouts/my-layout.data';
 *
 * const wrapPage = createPageWrapper(myLayout);
 * const dataWrapper = createDataWrapper(myLayoutData);
 *
 * export default wrapPage((props) => {
 *   return <>{...}</>;
 * });
 *
 * export const getStaticProps = dataWrapper.wrapGetStaticProps(...);
 * // or...
 * export const getServerSideProps = dataWrapper.wrapGetServerSideProps(...);
 * ```
 */
export function createLayout<Data = any>(options: CreateLayoutOptions<Data>): Layout<Data> {
  const PageContext = createContext<Data | null>(null);

  const layout: Layout<Data> = {
    name: options.name,

    useData: () => {
      const ctx = useContext(PageContext);
      const { pathname } = useRouter();

      if (ctx == null) {
        throw createError('DATA_UNAVAILABLE', {
          errorContext: 'useData',
          location: pathname,
          layoutName: options.name,
          message: `Data for this layout is unavailable for one of the following reasons:
  - The page is not wrapped with the result of createPageWrapper().
  - useData() may have been called from within getLayout() itself, which is a mistake!
    Instead, use the second \`data\` parameter given to getLayout(page, data).
                                                                      ^^^^
  - No data fetcher is assigned to this layout.
  - getStaticProps() or getServerSideProps() is not wrapped with the result of createDataWrapper().`,
        });
      }

      return ctx;
    },

    createDataFetcher: (getData) => {
      const dataLayout: DataLayout = {
        getData: async (ctx) => {
          const data = (await getData(ctx)) ?? null;

          return {
            props: {
              [`__next_super_layout:${options.name}`]: data,
            },
          };
        },
      };
      return dataLayout;
    },
  };

  setLayoutMeta(layout, { ...options, PageContext });

  return layout;
}

export function createPageWrapper<T extends Array<Layout<any>>>(...layouts: T): PageWrapperFn {
  const isCombinedLayout = layouts.length > 1;

  if (isCombinedLayout) {
    const layoutNames = layouts.map((l) => getLayoutMeta(l).name);

    // Validate `layouts` contains only unique values for `name`.
    if (new Set(layoutNames).size !== layoutNames.length) {
      const uniq = layoutNames
        .map((name) => ({ count: 1, name }))
        .reduce((a, b) => {
          a[b.name] = (a[b.name] || 0) + b.count;
          return a;
        }, {} as Record<string, number>);

      const duplicates = Object.keys(uniq).filter((a) => uniq[a] > 1);

      throw createError('COMBINED_LAYOUT_NAME_CONFLICT', {
        errorContext: 'createPageWrapper',
        message: `Layouts must have unique \`name\` values to be combinable. Conflicting name(s) found: ${duplicates.join(
          ', ',
        )}`,
      });
    }
  }

  const pageWrapper: PageWrapperFn = (Page) => {
    return Object.assign(
      (props: any) => {
        // Raise an error if a page is implemented without
        // <LayoutProvider> wrapping the Next.js _app
        if (!useContext(LayoutProviderContext)) {
          throw createError('LAYOUT_PROVIDER_NOT_IMPLEMENTED', {
            message: 'Before layouts can be utilized, you must wrap your Next.js `_app` with <LayoutProvider>',
          });
        }

        return <Page {...props} />;
      },

      {
        '__next_super_layout:getLayout': (node: React.ReactElement<any>) => {
          const pagesCombined = layouts.reduceRight((element, l) => {
            const { name, getLayout, PageContext } = getLayoutMeta(l);
            const layoutProps = node.props[`__next_super_layout:${name}`];

            // TODO: merge `layoutProps` with current `PageContext` value, if defined?
            //       https://nextjs.org/blog/layouts-rfc

            return (
              <PageContext.Provider value={layoutProps}>
                {getLayout ? getLayout(element, layoutProps) : element}
              </PageContext.Provider>
            );
          }, node);

          return <>{pagesCombined}</>;
        },
      },
    );
  };

  return pageWrapper;
}

async function defaultGetProps(): Promise<any> {
  return {
    props: {},
  };
}

export function createDataWrapper<T extends Array<DataLayout>>(...fetchers: T) {
  const getPropsWrapper = (wrappedFetcher = defaultGetProps) => {
    return async (ctx: any) => {
      const ssgConfigs = await Promise.all(
        [...fetchers.map((f) => f.getData), wrappedFetcher].map(async (fetcher) => {
          return (await fetcher?.(ctx)) ?? {};
        }),
      );

      return ssgConfigs.reduce((acc, ssgConfig) => {
        return {
          ...acc,
          ...ssgConfig,
          props: {
            ...(acc.props ?? {}),
            ...(ssgConfig.props ?? {}),
          },
        };
      }, {} as any);
    };
  };

  return {
    wrapGetStaticProps: getPropsWrapper as GetStaticPropsWrapper,
    wrapGetServerSideProps: getPropsWrapper as GetServerSidePropsWrapper,
  };
}

// --- App connectors ------------------------------------------------------- //

export type LayoutProps = Pick<AppProps, 'Component' | 'pageProps'>;

function RenderLayout({ children }: PropsWithChildren<any>) {
  // TODO: handle root layouts here when the new NextJS convention lands?
  //       https://nextjs.org/blog/layouts-rfc

  const mappedChildren = React.Children.map(children, (node) => {
    if (React.isValidElement(node)) {
      const Component = node.type as PageWithLayout;
      if (Component['__next_super_layout:getLayout']) {
        console.log('here', node);
        return Component['__next_super_layout:getLayout'](node);
      }
    }
    return node;
  });

  return <>{mappedChildren}</>;
}

RenderLayout.displayName = 'next-super-layout:RenderLayout';

/**
 * Renders a page with layout data. For use within a custom NextJS `_app` component.
 *
 * @example
 * ```ts
 * // pages/_app
 * import { LayoutProvider } from 'next-super-layout';
 *
 * export default function App(props) {
 *   return <LayoutProvider {...props} />;
 * }
 * ```
 */
function LayoutProviderLegacy({ Component, pageProps }: LayoutProps) {
  return (
    <LayoutProviderContext.Provider value>
      <RenderLayout>
        <Component {...pageProps} />
      </RenderLayout>
    </LayoutProviderContext.Provider>
  );
}

LayoutProviderLegacy.displayName = 'next-super-layout:LayoutProvider';

/**
 * W.I.P.
 * Renders a page with layout data. For use within a custom NextJS `app/.../layout.js` component.
 *
 * @example
 * ```ts
 * // app/layout.js
 * import { LayoutProvider } from 'next-super-layout';
 *
 * export default function RootLayout(props) {
 *   return <LayoutProvider.Server {...props} />;
 * }
 * ```
 */
function LayoutProviderServer(props: PropsWithChildren<any>) {
  return (
    <LayoutProviderContext.Provider value>
      <RenderLayout {...props} />
    </LayoutProviderContext.Provider>
  );
}

LayoutProviderServer.displayName = 'next-super-layout:LayoutProvider.Server';

// TODO: Support for NextJS official layouts
//       https://nextjs.org/blog/layouts-rfc
export const LayoutProvider = Object.assign(LayoutProviderLegacy /* , { Server: LayoutProviderServer } */);

// --- Utilities ------------------------------------------------------------ //

function setLayoutMeta(layout: Layout<any>, meta: LayoutMeta) {
  return ((layout as any)['__layoutMeta'] = meta);
}

function getLayoutMeta(layout: Layout<any>): LayoutMeta {
  return (layout as any)['__layoutMeta'];
}
