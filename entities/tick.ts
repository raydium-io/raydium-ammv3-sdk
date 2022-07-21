

export type TickPosition = {
    wordPos: number
    bitPos: number
  }
  
  /**
   * 
   * @param tickBySpacing 
   * @returns 
   */
  export function tickPosition(tickBySpacing: number): TickPosition {
    return {
      wordPos: tickBySpacing >> 8,
      bitPos: tickBySpacing % 256 & 255 // mask with 255 to get the output
    }
  }