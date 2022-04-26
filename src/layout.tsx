import type { AppProps } from 'next/app';
import { useRouter } from 'next/router.js';
import React, { createContext, useContext, useMemo } from 'react';
import { createError } from './exceptions';
import {
  CreateLayoutOptions,
  Layout,
  LayoutData,
  PageWithLayout,
  WrappedPage,
  UnwrapArray,
  CombinedLayout,
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
  const layoutKey = `__layout:${options.name}`;
  const isCombinedLayout = options.name.startsWith('__combined');

  const PageContext = createContext(false);

  return {
    // @ts-ignore - This is used internally; not exposed to public API.
    __layoutMeta: { ...options, PageContext },

    wrapPage: (Page) => {
      return Object.assign(
        (props: any) => {
          // Raise an error if a page is implemented without
          // <LayoutProvider> wrapping the Next.js _app
          if (!useContext(LayoutProviderContext)) {
            throw createError('LAYOUT_PROVIDER_NOT_IMPLEMENTED', {
              errorContext: 'wrapPage',
              message: 'Before layouts can be utilized, you must wrap your Next.js `_app` with <LayoutProvider>',
            });
          }

          return <Page {...props} />;
        },

        {
          getLayout: (Component: any, pageProps: any) => {
            const { [layoutKey]: layoutProps, ...rest } = pageProps;

            const currCtx = useContext(LayoutDataContext);
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

            const page = (
              <LayoutDataContext.Provider value={ctx}>
                {options.getLayout ? options.getLayout(<Component {...rest} />, layoutProps) : <Component {...rest} />}
              </LayoutDataContext.Provider>
            );

            // For combined layouts, the `PageContext` is provided in `combineLayouts`
            return isCombinedLayout ? page : <PageContext.Provider value>{page}</PageContext.Provider>;
          },
        },
      ) as WrappedPage;
    },

    wrapGetStaticProps: (wrappedGetStaticProps = defaultGetProps as any) => {
      return async (ctx) => {
        const staticProps: any = (await wrappedGetStaticProps(ctx)) ?? {};
        const layoutStaticProps: any = await options.getData?.(ctx);

        return {
          ...staticProps,
          props: {
            ...(staticProps.props ?? {}),
            [layoutKey]: layoutStaticProps?.[layoutKey] ?? layoutStaticProps ?? null,
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
            [layoutKey]: layoutStaticProps?.[layoutKey] ?? layoutStaticProps ?? null,
          },
        };
      };
    },

    useData: () => {
      const ctx = useContext(LayoutDataContext);
      const { pathname } = useRouter();

      if (!useContext(PageContext)) {
        throw createError('PAGE_WRAP_MISSING', {
          errorContext: 'useData',
          location: pathname,
          layoutName: options.name,
          message: 'Data for this layout unavailable because this page is not wrapped with wrapPage()',
        });
      }

      if (ctx[layoutKey] == null) {
        throw createError('DATA_UNAVAILABLE', {
          errorContext: 'useData',
          location: pathname,
          layoutName: options.name,
          message: `Data for this layout unavailable for one of these reasons:
  - getData() is not defined for this layout.
  - getStaticProps() or getServerSideProps() is not wrapped for this layout.
  - useData() may have been called within getLayout().
    Use the second \`data\` parameter given to getLayout() instead.`,
        });
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

type LayoutMeta = CreateLayoutOptions<any> & {
  PageContext: React.Context<boolean>;
};

const getMetaFromLayout = (layout: Layout<any> | CombinedLayout<any>): LayoutMeta => (layout as any)['__layoutMeta'];

/**
 * Combines layout objects (the result of `createLayout(...)`) into a singular layout.
 *
 * @example
 * ```tsx
 * // pages/some/path.tsx
 * import { combineLayouts } from 'next-super-layout';
 * import { myLayout } from './layouts/my-layout';
 * import { myOtherLayout } from './layouts/my-other-layout';
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
export function combineLayouts<T extends Array<Layout<any>>>(...layouts: T): CombinedLayout<T> {
  const layoutNames = layouts.map((l) => getMetaFromLayout(l).name);

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
      errorContext: 'combineLayouts',
      message: `Layouts must have unique \`name\` values to be combinable. Conflicting name(s) found: ${duplicates.join(
        ', ',
      )}`,
    });
  }

  const result = createLayout<LayoutData<UnwrapArray<T>>>({
    name: `__combined(${layoutNames.join(';')})`,

    getLayout: (page, data) => {
      const pagesCombined = layouts.reduceRight((element, l) => {
        const { name, getLayout, PageContext } = getMetaFromLayout(l);
        const layoutKey = `__layout:${name}`;
        return (
          <PageContext.Provider value>{getLayout ? getLayout(element, data[layoutKey]) : element}</PageContext.Provider>
        );
      }, <>{page}</>);

      return <>{pagesCombined}</>;
    },

    getData: async (ctx) => {
      const results = await Promise.all(
        layouts.map(async (l) => {
          const layoutOptions = getMetaFromLayout(l);
          const layoutKey = `__layout:${layoutOptions.name}`;
          return { [layoutKey]: (await layoutOptions.getData?.(ctx)) ?? null };
        }),
      );

      return Object.assign({}, ...results.filter(Boolean));
    },
  });

  // @ts-ignore - We omit `useData` from the final result type.
  delete result.useData;

  return result as Omit<typeof result, 'useData'>;
}

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
