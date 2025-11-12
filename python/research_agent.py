#!/usr/bin/env python3
"""
GPT Researcher Agent for Guru Builder System

This script performs autonomous research using GPT Researcher and returns
structured JSON output to the Next.js backend via subprocess communication.

Usage:
  python research_agent.py "<instructions>" "<depth>"

Example:
  python research_agent.py "Research backgammon opening strategies" "moderate"

Output:
  JSON object with research findings, sources, and summary
"""

import sys
import json
import os
import logging
import warnings
from typing import Dict, List, Any, Literal
from dotenv import load_dotenv

# Suppress warnings and redirect ALL logging to stderr to keep stdout clean for JSON
warnings.filterwarnings('ignore')

# Configure root logger to use stderr (keep stdout clean for JSON)
logging.basicConfig(
    level=os.getenv('RESEARCH_LOG_LEVEL', 'WARNING'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # Critical: send logs to stderr, not stdout
)

# Configure noisy third-party loggers
for logger_name in ['httpx', 'httpcore', 'openai', 'langchain', 'urllib3']:
    logging.getLogger(logger_name).setLevel(logging.ERROR)  # Show errors, suppress info/debug

# GPT Researcher is extra verbose - suppress completely
logging.getLogger('gpt_researcher').setLevel(logging.CRITICAL)

# Load environment variables
load_dotenv()

# Type definitions
ResearchDepth = Literal["quick", "moderate", "deep"]

class ResearchConfig:
    """Configuration for research depth levels."""

    DEPTH_SETTINGS = {
        "quick": {
            "max_sources": 5,
            "max_iterations": 2,
            "report_type": "research_report",
        },
        "moderate": {
            "max_sources": 10,
            "max_iterations": 4,
            "report_type": "research_report",
        },
        "deep": {
            "max_sources": 20,
            "max_iterations": 6,
            "report_type": "detailed_report",
        },
    }

    @classmethod
    def get_settings(cls, depth: ResearchDepth) -> Dict[str, Any]:
        """Get configuration settings for a given research depth."""
        return cls.DEPTH_SETTINGS.get(depth, cls.DEPTH_SETTINGS["moderate"])


async def conduct_research(
    instructions: str,
    depth: ResearchDepth = "moderate"
) -> Dict[str, Any]:
    """
    Conduct autonomous research using GPT Researcher.

    IMPORTANT: Stdout Capture Architecture
    =======================================
    This script runs as an isolated subprocess spawned by Next.js.
    Each research request gets its own Python process with isolated stdout.

    We temporarily redirect sys.stdout to suppress third-party print statements
    from GPT Researcher dependencies (Tavily, BeautifulSoup, PyMuPDF) that
    would corrupt JSON output.

    This is SAFE because:
    - Each subprocess is single-threaded
    - Process lifetime = single research request
    - No concurrent operations in the same process

    DO NOT convert to long-running service without refactoring logging.

    Args:
        instructions: Research query or instructions
        depth: Research depth level (quick, moderate, deep)

    Returns:
        Dictionary containing research findings, sources, and metadata

    Raises:
        ValueError: If research returns invalid data structure
        Exception: Any errors from GPT Researcher propagate up
    """
    try:
        from gpt_researcher import GPTResearcher
        from io import StringIO
    except ImportError as e:
        # Fallback for POC testing without actual GPT Researcher
        logging.warning(f"GPT Researcher not available: {e}. Running in POC mode.")

        # Get config even in POC mode for consistent structure
        config = ResearchConfig.get_settings(depth)

        return {
            "query": instructions,
            "depth": depth,
            "summary": "⚠️ POC MODE: GPT Researcher not installed. This is TEST DATA.",
            "fullReport": (
                f"# POC Mode Research Report\n\n"
                f"Query: {instructions}\n"
                f"Depth: {depth}\n\n"
                f"⚠️ This is simulated data because GPT Researcher is not installed.\n"
                f"To enable real research:\n"
                f"1. Ensure Python venv is activated\n"
                f"2. Run: pip install gpt-researcher\n"
                f"3. Set OPENAI_API_KEY in .env\n"
            ),
            "sources": [
                {"url": "https://example.com/source1", "title": "Example Source 1"},
                {"url": "https://example.com/source2", "title": "Example Source 2"},
            ],
            "sourcesAnalyzed": 2,
            "metadata": {
                "maxSources": config["max_sources"],
                "maxIterations": config["max_iterations"],
                "reportType": "poc_mode",
                "mode": "POC",
                "status": "test",
                "warning": "GPT Researcher not installed - using test data"
            },
        }

    # Get depth-specific settings
    config = ResearchConfig.get_settings(depth)

    # Create logger for this operation
    research_logger = logging.getLogger('research_agent')

    # Capture stdout to suppress library print statements (e.g., Tavily warnings)
    old_stdout = sys.stdout
    captured_output = StringIO()
    sys.stdout = captured_output

    try:
        # Initialize GPT Researcher
        researcher = GPTResearcher(
            query=instructions,
            report_type=config["report_type"],
            config_path=None,  # Use default config
        )

        # Conduct research
        await researcher.conduct_research()

        # Generate report
        report = await researcher.write_report()

        # Get sources
        sources = researcher.get_source_urls()

    except Exception as e:
        # On error, log captured output for debugging
        suppressed_output = captured_output.getvalue()
        if suppressed_output.strip():
            research_logger.error(
                f"Research failed with suppressed output: {suppressed_output[:500]}"
            )
        raise  # Re-raise after logging
    finally:
        # Always restore stdout
        sys.stdout = old_stdout

        # Log warnings/errors from suppressed output (even on success)
        suppressed_output = captured_output.getvalue()
        if suppressed_output.strip():
            # Check for error patterns
            if any(err in suppressed_output.lower() for err in ['error', 'failed', 'timeout', 'exception']):
                research_logger.warning(
                    f"Suppressed output contained errors: {suppressed_output[:200]}"
                )
            else:
                research_logger.debug(f"Suppressed output: {suppressed_output[:200]}")

    # Validate data types before constructing findings
    if not isinstance(report, str):
        raise ValueError(f"Research report must be string, got {type(report)}")
    if sources is None:
        sources = []
    if not isinstance(sources, list):
        raise ValueError(f"Research sources must be list, got {type(sources)}")

    # Structure findings with validated data
    findings = {
        "query": instructions,
        "depth": depth,
        "summary": report[:500] + "..." if len(report) > 500 else report,
        "fullReport": report,
        "sources": [
            {
                "url": str(url),  # Ensure URL is string
                "title": f"Source {idx + 1}",  # GPT Researcher doesn't provide titles
            }
            for idx, url in enumerate(sources[:config["max_sources"]])
            if url  # Skip empty/None URLs
        ],
        "sourcesAnalyzed": len(sources),
        "metadata": {
            "maxSources": config["max_sources"],
            "maxIterations": config["max_iterations"],
            "reportType": config["report_type"],
        },
    }

    return findings


def main():
    """Main entry point for the research agent."""

    # Validate arguments
    if len(sys.argv) < 3:
        error = {
            "error": "Missing required arguments",
            "usage": "python research_agent.py '<instructions>' '<depth>'",
            "example": "python research_agent.py 'Research backgammon' 'moderate'",
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

    instructions = sys.argv[1]
    depth = sys.argv[2]

    # Validate depth
    if depth not in ["quick", "moderate", "deep"]:
        error = {
            "error": f"Invalid depth: {depth}",
            "valid_depths": ["quick", "moderate", "deep"],
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

    # Validate OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        error = {
            "error": "OPENAI_API_KEY environment variable not set",
            "solution": "Set OPENAI_API_KEY in .env file",
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)

    # Conduct research (async)
    import asyncio

    try:
        findings = asyncio.run(conduct_research(instructions, depth))

        # Output JSON to stdout (consumed by Next.js subprocess)
        print(json.dumps(findings, indent=2))
        sys.exit(0)

    except Exception as e:
        error = {
            "error": "Research failed",
            "message": str(e),
            "type": type(e).__name__,
        }
        print(json.dumps(error), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
