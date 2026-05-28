async function loadMeta(id){

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

  return json;
}


/*
 extract manifest
*/
function getManifest(meta){

  if(
    meta.qualities &&
    meta.qualities.auto
  ){

    const arr =
      meta.qualities.auto;

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

  return null;
}


/*
 proxy file
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


  const pass = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges"
  ];


  for(const key of pass){

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
 recursive manifest proxy
*/
async function proxyManifest(
  manifestUrl,
  origin
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


  let text =
    await upstream.text();


  const base =
    manifestUrl.substring(
      0,
      manifestUrl.lastIndexOf("/") + 1
    );


  text =
    text.replace(
      /^([^#].+)$/gm,
      line => {

        if(
          !line ||
          line.startsWith("#")
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


        /*
         nested m3u8
        */
        if(
          full.includes(
            ".m3u8"
          )
        ){

          return `${origin}/proxy.m3u8?url=${encodeURIComponent(full)}`;
        }


        /*
         ts / mp4 segment
        */
        return `${origin}/seg?u=${encodeURIComponent(full)}`;
      }
    );


  return new Response(
    text,
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
          "DMTV RECURSIVE V1"
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


      /*
       nested manifest
      */
      if(
        url.pathname ===
        "/proxy.m3u8"
      ){

        const manifest =
          url.searchParams.get(
            "url"
          );

        return await proxyManifest(
          manifest,
          url.origin
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


      const manifest =
        getManifest(
          meta
        );


      if(
        !manifest
      ){

        return Response.json(
          meta
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

          manifest
        });
      }


      return await proxyManifest(
        manifest,
        url.origin
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
