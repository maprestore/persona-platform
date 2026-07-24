"""Example using the SDK client."""

from sdk.client import PersonaClient


def main() -> None:
    client = PersonaClient(base_url="http://localhost:6967")

    status = client.health()
    print(f"Server status: {status}")

    result = client.swap(source_id="face_a.jpg", target_id="video_input.mp4")
    print(f"Swap result: {result}")

    client.close()


if __name__ == "__main__":
    main()