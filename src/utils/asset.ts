export async function loadImage(uri: string): Promise<HTMLImageElement> {
    const image = new Image();
    return new Promise((resolve, reject) => {
        image.onerror = () => {
            reject(`Failed to load ${uri}`);
        };
        image.onload = () => {
            resolve(image);
        };
        image.src = uri;
    });
}