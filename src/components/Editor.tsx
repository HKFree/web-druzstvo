import type { Config } from '@keystatic/core';
import { Keystatic } from '@keystatic/core/ui';
import config from '../../keystatic.config';

export default function Editor() {
  return <Keystatic config={config as Config} />;
}
