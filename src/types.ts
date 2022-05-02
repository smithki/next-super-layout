import type { GetServerSideProps, GetStaticProps, GetStaticPropsContext } from 'next';
import type { AppProps } from 'next/app';
import type { ParsedUrlQuery } from 'querystring';
import type { ComponentType, ReactElement, ReactNode } from 'react';

export type PageWithLayout<Props = any> = ComponentType<Props> & {
  getLayout?: (Component: AppProps['Component'], pageProps: any) => ReactNode;
};

export type PageWrapperFn = <Props>(page: ComponentType<Props>) => WrappedPage<Props>;
export type WrappedPage<Props = any> = ComponentType<Props> & { getLayout?: GetLayoutFn<any> };

export type GetLayoutFn<Data> = (page: ReactElement, data: Data) => ReactNode;

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
  name: string;
  getLayout?: GetLayoutFn<Data>;
}

export type Layout<Data = any> = {
  name: string;
  useData: () => Data;
  createDataFetcher: (fetcher: GetDataFn<Data>) => DataLayout;
};

export type DataLayout = {
  getData: GetStaticProps;
};

export type LayoutMeta = CreateLayoutOptions<any> & {
  PageContext: React.Context<boolean>;
};

export type LayoutData<T extends Layout<any>> = T extends Layout<infer R> ? R : never;
