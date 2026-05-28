async function loadMeta(
  id
){

  const json =
    await fetch(
      `https://www.dailymotion.com/player/metadata/video/${id}`,
      {
        headers:{
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    ).then(
      r => r.json()
    );


  if(
    !json.qualities
  ){
    throw new Error(
      "metadata"
    );
  }


  return json;
}


/*
 best hls
*/
function getBest(
  qualities
){

  const order =
    [
      "auto",
      "1080",
      "720",
      "480",
      "380",
      "240"
    ];


  for(
    const q
    of order
  ){

    const arr =
      qualities[q];

    if(
      arr &&
      arr.length
    ){

      const hls =
        arr.find(
          x =>
            x.type &&
            x.type.includes(
              "mpegURL"
            )
        );

      if(hls){
        return hls.url;
      }
    }
  }

  return null;
}


/*
 segment proxy
*/
async function proxyFile(
  fileUrl,
  request
){

  const headers = {

    "User-Agent":
      "Mozilla/5.0",

    "Referer":
      "https://www.dailymotion.com/"
  };


  const range =
    request.headers.get(
      "range"
    );


  if(range){

    headers[
      "Range"
    ] = range;
  }


  const upstream =
    await fetch(
      fileUrl,
      {
        headers
      }
    );


  const out =
    new Headers();


  const pass =
    [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges"
    ];


  for(
    const key
    of pass
  ){

    const value =
      upstream.headers.get(
        key
      );

    if(value){

      out.set(
        key,
        value
      );
    }
  }


  out.set(
    "Access-Control-Allow-Origin",
    "*"
  );


  return new Response(
    upstream.body,
    {
      status:
        upstream.status,

      headers:
        out
    }
  );
}


/*
 manifest proxy
*/
async function proxyManifest(
  manifestUrl,
  origin,
  request
){

  const upstream =
    await fetch(
      manifestUrl,
      {
        headers:{
          "User-Agent":
            "Mozilla/5.0"
        }
      }
    );


  let manifest =
    await upstream.text();


  const base =
    manifestUrl.substring(
      0,
      manifestUrl.lastIndexOf("/") + 1
    );


  manifest =
    manifest.replace(
      /^([^#].+)$/gm,
      line => {

        if(
          line.startsWith(
            "#"
          )
        ){
          return line;
        }

        let full =
          line;

        if(
          !line.startsWith(
            "http"
          )
        ){

          full =
            base + line;
        }

        return `${origin}/seg?u=${encodeURIComponent(full)}`;
      }
    );


  return new Response(
    manifest,
    {
      headers:{

        "Content-Type":
          "application/vnd.apple.mpegurl",

        "Access-Control-Allow-Origin":
          "*"
      }
    }
  );
}


export default {

  async fetch(
    request
  ){

    try{

      const url =
        new URL(
          request.url
        );


      /*
       debug
      */
      if(
        url.pathname ===
        "/debug"
      ){

        return new Response(
          "DMTV V1"
        );
      }


      /*
       segment
      */
      if(
        url.pathname ===
        "/seg"
      ){

        const file =
          url.searchParams.get(
            "u"
          );

        return await proxyFile(
          file,
          request
        );
      }


      const path =
        url.pathname
          .replace("/", "");


      const id =
        path
          .replace(".json","")
          .replace(".m3u8","");


      const meta =
        await loadMeta(
          id
        );


      const stream =
        getBest(
          meta.qualities
        );


      if(
        !stream
      ){
        throw new Error(
          "stream"
        );
      }


      /*
       json
      */
      if(
        path.endsWith(
          ".json"
        )
      ){

        return Response.json({

          id,

          title:
            meta.title,

          stream
        });
      }


      /*
       hls
      */
      return await proxyManifest(
        stream,
        url.origin,
        request
      );
    }
    catch(e){

      return new Response(
        e.message,
        {
          status:500
        }
      );
    }
  }
}
