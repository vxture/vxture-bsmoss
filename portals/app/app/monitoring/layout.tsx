import type {ReactNode} from 'react';
import {pageMetadata} from '../portal/page-metadata';

export const metadata=pageMetadata('/monitoring');
export default function ModuleLayout({children}:{children:ReactNode}) {return children;}
