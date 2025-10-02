FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y ffmpeg curl

# Create folder for HLS output
RUN mkdir -p /hls
WORKDIR /hls

# Expose port for HTTP serving
EXPOSE 8080

# Start a simple FFmpeg HLS server
# Replace `input.mp3` with your audio source or OBS RTMP input
CMD ffmpeg -re -i input.mp3 \
    -c:a aac -b:a 128k \
    -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments \
    /hls/out.m3u8
