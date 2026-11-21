export function rememberForward(currentId:string,forwardIds:readonly string[]):string[]{
  return currentId?[currentId,...forwardIds]:[...forwardIds];
}

export function takeForward(forwardIds:readonly string[]):{next?:string;remaining:string[]}{
  const [next,...remaining]=forwardIds;
  return {next,remaining};
}
