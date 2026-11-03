const portraits = import.meta.glob<string>("../assets/quote-portraits/*.png", {
  eager: true, query: "?url", import: "default",
});

export default function QuotePortrait({id,author}:{id:string;author:string}) {
  // Four separately drawn poses share one transparent atlas per new author.
  const atlas = /^(.*)-0([1-4])$/.exec(id);
  const cell = atlas ? Number(atlas[2]) - 1 : 0;
  const source=portraits[`../assets/quote-portraits/${atlas ? `${atlas[1]}-plate` : id}.png`];
  return <span className="quote-line-portrait" data-portrait={id} data-cell={atlas ? cell : undefined}>
    <img src={source} alt={`Pen-and-ink portrait of ${author}`} decoding="async"
      style={{position:'absolute',maxWidth:'none',width:atlas?'200%':'100%',height:atlas?'200%':'100%',left:atlas?`${-(cell%2)*100}%`:0,top:atlas?`${-Math.floor(cell/2)*100}%`:0,objectFit:'contain'}}/>
  </span>;
}
