import { useRouter } from 'next/router.js';
import React, { createContext, useContext } from 'react';
import { createError } from '../exceptions';
import {
  CreateLayoutOptions,
  Layout,
  LayoutMeta,
  PageWrapperFn,
  GetStaticPropsWrapper,
  GetServerSidePropsWrapper,
  DataLayout,
} from '../types';

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
  if (layouts.length > 1) {
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
    return (props: any) => {
      const pagesCombined = layouts.reduceRight((element, l) => {
        const { name, getLayout, PageContext } = getLayoutMeta(l);
        const layoutProps = props[`__next_super_layout:${name}`];

        return (
          <PageContext.Provider value={layoutProps}>
            {getLayout ? getLayout(element, layoutProps) : element}
          </PageContext.Provider>
        );
      }, <Page {...props} />);

      return <>{pagesCombined}</>;
    };
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
// --- Utilities ------------------------------------------------------------ //

function setLayoutMeta(layout: Layout<any>, meta: LayoutMeta) {
  return ((layout as any)['__layoutMeta'] = meta);
}

function getLayoutMeta(layout: Layout<any>): LayoutMeta {
  return (layout as any)['__layoutMeta'];
}
