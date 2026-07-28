// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Ben Richardson <hi@ben.gy>
import type { Dataset } from './data';
import type { ViewId } from './types';

export interface ViewContext {
  data: Dataset;
  openItem: (code: string) => void;
  goTo: (view: ViewId) => void;
  /** open the item-lookup view pre-seeded with codes to compare */
  compare: (codes: string[]) => void;
}
