<!-- markdownlint-disable no-inline-html -->
# Note

ref: <https://github.com/usememos/memos>

## Difference

1. Enhanced media display
2. Content hiding

## Build and Run

```bash
docker buildx build -t memos:dev --load . 

docker run --rm --name memos -p 15230:5230 -v ./build:/var/opt/memos memos:dev
```

## Screenshot

<details><summary>Details</summary>
<p align="center">
 <img src="./screenshots/media-1.png" alt="media-1" />
 <img src="./screenshots/media-2.png" alt="media-2" />
 <img src="./screenshots/media-3.png" alt="media-3" />
</p>

<p align="center">
 <img src="./screenshots/hidden-1.png" alt="hidden-1" />
</p>
</details>
