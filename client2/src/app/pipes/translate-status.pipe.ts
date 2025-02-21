import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'translateStatus'
})
export class TranslateStatusPipe implements PipeTransform {

  transform(status: string): string {
    switch (status) {
      case 'Created':
        return 'Создана';
      case 'Active':
        return 'Активна';
      case 'Expired':
        return 'Истек срок действия';
      case 'Blocked':
      case 'Locked':
        return 'Заблокирована';
      default:
        return 'Неизвестный статус';
    }
  }

}
