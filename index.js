import edgeworker from "./edgeworker";

export async function onClientRequest(request) {
  await edgeworker.onClientRequest(request);
}

export async function onClientResponse(request, response) {
  await edgeworker.onClientResponse(request, response);
}

// export async function onOriginResponse(request, response) {
//   await edgeworker.onOriginResponse(request, response);
// }

// export async function responseProvider(request) {
//   return await edgeworker.responseProvider(request);
// }
