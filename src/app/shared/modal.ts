import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
        (click)="closed.emit()"
        role="presentation"
      >
        <div
          class="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="ปิด"
              (click)="closed.emit()"
            >
              ✕
            </button>
          </div>
          <div class="px-5 py-4"><ng-content /></div>
        </div>
      </div>
    }
  `,
})
export class Modal {
  open = input(false);
  title = input('');
  closed = output<void>();
}
