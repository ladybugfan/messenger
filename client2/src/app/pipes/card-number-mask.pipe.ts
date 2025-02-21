import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'cardNumberMask'
})
export class CardNumberMaskPipe implements PipeTransform {

  transform(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 4) {
      return cardNumber;
    }
  
    const visibleDigits = cardNumber.slice(-4);
  
    const maskedSection = cardNumber
      .slice(0, -4)
      .replace(/\d/g, 'X');
  
    const maskedCardNumber = `${maskedSection}${visibleDigits}`;
  
    const formattedCardNumber = maskedCardNumber.match(/.{1,4}/g)?.join(' ') || maskedCardNumber;
  
    return formattedCardNumber;
  }
  

}
