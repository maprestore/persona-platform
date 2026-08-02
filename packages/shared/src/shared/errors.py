from __future__ import annotations


class PersonaError(Exception):
    """Base class for expected application failures."""


class FeatureUnavailableError(PersonaError):
    def __init__(self, feature: str, reason: str) -> None:
        self.feature = feature
        self.reason = reason
        super().__init__(f"{feature} is unavailable: {reason}")


class MediaProcessingError(PersonaError):
    """Raised when a media reader, writer, or codec fails."""


class PipelineValidationError(PersonaError):
    """Raised when a pipeline graph is invalid."""
