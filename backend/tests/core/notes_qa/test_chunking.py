from personal.core.notes_qa.chunking import CHUNK_SIZE, split_note


def test_splits_on_headings_and_keeps_the_heading_path() -> None:
    markdown = "# Samochód\n\n## Opony\n\nZimowe w listopadzie.\n\n## Ubezpieczenie\n\nOC do 14 marca.\n"

    chunks = split_note(markdown)

    assert [(chunk.heading_path, chunk.text) for chunk in chunks] == [
        ("Samochód / Opony", "Zimowe w listopadzie."),
        ("Samochód / Ubezpieczenie", "OC do 14 marca."),
    ]


def test_a_hash_inside_a_code_block_is_not_a_heading() -> None:
    markdown = "## Serwer\n\n```bash\n# komentarz\nsudo ufw status\n```\n"

    chunks = split_note(markdown)

    assert len(chunks) == 1
    assert "# komentarz" in chunks[0].text


def test_a_long_section_is_split_and_every_part_keeps_its_heading() -> None:
    paragraph = "Kopia zapasowa bazy robi się codziennie o 3:00 z crona. " * 15
    markdown = f"## Kopia zapasowa bazy\n\n{paragraph}\n\n{paragraph}"

    chunks = split_note(markdown)

    assert len(chunks) > 1
    assert all(chunk.heading_path == "Kopia zapasowa bazy" for chunk in chunks)
    assert all(len(chunk.text) <= CHUNK_SIZE for chunk in chunks)
