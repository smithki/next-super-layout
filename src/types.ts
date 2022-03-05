import type { GetServerSideProps, GetStaticProps, GetStaticPropsContext } from 'next';
import type { AppProps } from 'next/app';
import type { ParsedUrlQuery } from 'querystring';
import type { ComponentType, ReactElement, ReactNode } from 'react';

export type PageWithLayout<Props = any> = ComponentType<Props> & {
  getLayout?: (Component: AppProps['Component'], pageProps: any) => ReactNode;
};

export type GetLayoutFn<Data> = (page: ReactElement, data: Data) => ReactNode;

export type WrappedPage<Data = any, Props = any> = ComponentType<Props> & { getLayout?: GetLayoutFn<Data> };

export interface CreateLayoutOptions<Data> {
  name: string;
  getLayout?: GetLayoutFn<Data>;
  getData?: (ctx: GetStaticPropsContext) => Data | Promise<Data>;
}

export type Layout<Data = any> = {
  wrapPage: <Props>(page: ComponentType<Props>) => WrappedPage<Data, Props>;

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

export type LayoutData<T extends Layout<any>> = T extends Layout<infer R> ? R : never;
