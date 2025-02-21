import { CardNumberMaskPipe } from './card-number-mask.pipe';

describe('CardNumberMaskPipe', () => {
  it('create an instance', () => {
    const pipe = new CardNumberMaskPipe();
    expect(pipe).toBeTruthy();
  });
});
