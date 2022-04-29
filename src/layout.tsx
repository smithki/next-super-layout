import type { AppProps } from 'next/app';
import { useRouter } from 'next/router.js';
import React, { createContext, useContext, useMemo } from 'react';
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
const LayoutDataContext = /* @__PURE__ */ createContext<any>({});

/**
 * Creates a generic view for a layout, complete with layout-specific props,
 * fetched at build and/or request time.
 *
 * @example
 * ```tsx
 * // layouts/my-layout.tsx
 * import { createLayout } from 'next-super-layout';
 *
 * const myLayout = createLayout({
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
 *
 *   getData: async (ctx) => {
 *     // `ctx` is the `GetStaticPropsContext` object passed to `getStaticProps`.
 *     return { ... };
 *   },
 * });
 *
 * // pages/some/path.tsx
 * import { myLayout } from 'next-super-layout';
 *
 * export default myLayout.wrapPage((props) => {
 *   return <>{...}</>;
 * });
 *
 * export const getStaticProps = myLayout.wrapGetStaticProps(...);
 * // or...
 * export const getServerSideProps = myLayout.wrapGetServerSideProps(...);
 * ```
 */
export function createLayout<Data = any>(options: CreateLayoutOptions<Data>): Layout<Data> {
  const PageContext = createContext(false);

  const layout: Layout<Data> = {
    name: options.name,

    useData: () => {
      const ctx = useContext(LayoutDataContext);
      const { pathname } = useRouter();

      if (!useContext(PageContext)) {
        throw createError('PAGE_WRAP_MISSING', {
          errorContext: 'useData',
          location: pathname,
          layoutName: options.name,
          message: `Data for this layout is unavailable for one of the following reasons:
  - The page component isn't wrapped with the result of createPageWrapper().
  - useData() may have been called from within getLayout() itself, which is a mistake!
    Instead, use the second \`data\` parameter given to getLayout().`,
        });
      }

      if (ctx[options.name] == null) {
        throw createError('DATA_UNAVAILABLE', {
          errorContext: 'useData',
          location: pathname,
          layoutName: options.name,
          message: `Data for this layout is unavailable for one of the following reasons:
  - No data fetcher is assigned to this layout.
  - getStaticProps() or getServerSideProps() is not wrapped for this layout.`,
        });
      }

      return ctx[options.name];
    },

    createDataFetcher: (getData) => {
      const dataLayout: DataLayout = {
        getData: async (ctx) => {
          const data = (await getData(ctx)) ?? null;

          return {
            props: {
              __next_super_layout: {
                [options.name]: data,
              },
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
        getLayout: (PageComponent: any, pageProps: any) => {
          const pagesCombined = layouts.reduceRight((element, l) => {
            const { name, getLayout, PageContext } = getLayoutMeta(l);
            const { [name]: layoutProps } = pageProps.__next_super_layout;

            const currCtx = useContext(LayoutDataContext);
            const ctx: any = useMemo(() => {
              return {
                ...currCtx,
                [name]: layoutProps,
              };
            }, []);

            return (
              <PageContext.Provider value>
                <LayoutDataContext.Provider value={ctx}>
                  {getLayout ? getLayout(element, layoutProps) : element}
                </LayoutDataContext.Provider>
              </PageContext.Provider>
            );
          }, <PageComponent {...pageProps} />);

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
            __next_super_layout: {
              ...(acc.props?.__next_super_layout ?? {}),
              ...(ssgConfig.props?.__next_super_layout ?? {}),
            },
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

function RenderLayout({ Component, pageProps }: AppProps) {
  // Use the layout defined at the page level, if available...
  const getLayout = (Component as PageWithLayout).getLayout ?? ((C, P) => <C {...P} />);
  return <>{getLayout(Component, pageProps)}</>;
}

RenderLayout.displayName = 'RenderLayout';

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
export function LayoutProvider(props: AppProps) {
  return (
    <LayoutProviderContext.Provider value>
      <RenderLayout {...props} />
    </LayoutProviderContext.Provider>
  );
}

LayoutProvider.displayName = 'LayoutProvider';

// --- Utilities ------------------------------------------------------------ //

function setLayoutMeta(layout: Layout<any>, meta: LayoutMeta) {
  return ((layout as any)['__layoutMeta'] = meta);
}

function getLayoutMeta(layout: Layout<any>): LayoutMeta {
  return (layout as any)['__layoutMeta'];
}
