import type { GetServerSideProps, GetStaticProps, GetStaticPropsContext, NextPage } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { ComponentType } from 'react';

export type PageWrapperFn = <Props = {}>(page: ComponentType<Props>) => ComponentType<Props>;
export type GetLayoutFn<Data> = (page: JSX.Element, data: Data) => JSX.Element;
export type GetDataFn<Data> = (ctx: GetStaticPropsContext) => Data | Promise<Data>;

export type GetStaticPropsWrapper = <
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery,
>(
  wrappedGetStaticProps?: GetStaticProps<P, Q>,
) => GetStaticProps<P, Q>;

export type GetServerSidePropsWrapper = <
  P extends { [key: string]: any } = { [key: string]: any },
  Q extends ParsedUrlQuery = ParsedUrlQuery,
>(
  wrappedGetServerSideProps?: GetServerSideProps<P, Q>,
) => GetServerSideProps<P, Q>;

export interface CreateLayoutOptions<Data> {
  /**
   * A unique key identifying this layout for a NextJS page.
   */
  name: string;

  /**
   * Returns a React element wrapping a NextJS page with arbitrary UI.
   */
  getLayout?: GetLayoutFn<Data>;

  /**
   * Returns a React element wrapping a NextJS page with arbitrary UI.
   *
   * @alias for `getLayout`
   *
   * NOTE: `getLayout` takes precedence over `GetLayout`.
   */
  GetLayout?: GetLayoutFn<Data>;
}

export type Layout<Data = any> = {
  name: string;
  useData: () => Data;
  createDataFetcher: (fetcher: GetDataFn<Data>) => DataLayout;
};

export type DataLayout = {
  getData: GetStaticProps;
};

export type LayoutData<T extends Layout<any>> = T extends Layout<infer R> ? R : never;

export type PageWithLayout<Props = any> = NextPage<Props> & {
  ['__next_super_layout:getLayout']?: (Component: NextPage<Props>, pageProps: Props) => JSX.Element;
};
